use std::{path::PathBuf, time::Duration};

use ashpd::{desktop::screenshot::Screenshot, zbus::Connection};
use tokio::time::timeout;

fn screenshot_path(uri: &str) -> Result<PathBuf, String> {
    let url =
        tauri::Url::parse(uri).map_err(|_| "The screenshot portal returned an invalid URI.")?;
    if url.query().is_some() || url.fragment().is_some() {
        return Err("The screenshot portal returned an invalid file URI.".into());
    }
    url.to_file_path()
        .map_err(|_| "The screenshot portal did not return a local file.".into())
}

fn screenshot_response(result: ashpd::Result<Screenshot>) -> Result<Option<PathBuf>, String> {
    match result {
        Ok(screenshot) => screenshot_path(screenshot.uri().as_str()).map(Some),
        Err(ashpd::Error::Response(ashpd::desktop::ResponseError::Cancelled)) => Ok(None),
        Err(ashpd::Error::Response(ashpd::desktop::ResponseError::Other)) => Err(
            "Screenshot access was denied or the desktop could not complete the request. Check your desktop's screenshot permissions and try again.".into(),
        ),
        Err(error) => Err(format!("The desktop screenshot portal failed: {error}")),
    }
}

async fn request(
    connection: Connection,
    interactive: bool,
    deadline: Duration,
) -> Result<Option<PathBuf>, String> {
    let pending = Screenshot::request()
        .connection(Some(connection.clone()))
        .interactive(interactive)
        .modal(true)
        .send();
    let result = match timeout(deadline, pending).await {
        Ok(Ok(request)) => screenshot_response(request.response()),
        Ok(Err(error)) => screenshot_response(Err(error)),
        Err(_) => Err("The desktop screenshot request timed out. Please try again.".into()),
    };
    let _ = timeout(Duration::from_secs(2), connection.close()).await;
    result
}

pub async fn screenshot(interactive: bool) -> Result<Option<PathBuf>, String> {
    let connection = timeout(Duration::from_secs(10), Connection::session())
        .await
        .map_err(|_| "Connecting to the desktop screenshot portal timed out.")?
        .map_err(|error| format!("Could not connect to the desktop screenshot portal: {error}"))?;
    request(connection, interactive, Duration::from_secs(120)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{
        atomic::{AtomicU32, AtomicUsize, Ordering},
        Arc,
    };

    use ashpd::zbus::{
        self,
        message::Header,
        zvariant::{OwnedObjectPath, OwnedValue},
    };

    struct TestPortal {
        response: Arc<AtomicU32>,
        calls: Arc<AtomicUsize>,
    }

    #[zbus::interface(name = "org.freedesktop.portal.Screenshot", crate = "ashpd::zbus")]
    impl TestPortal {
        #[zbus(property)]
        fn version(&self) -> u32 {
            2
        }

        async fn screenshot(
            &self,
            _parent: &str,
            options: std::collections::HashMap<String, OwnedValue>,
            #[zbus(header)] header: Header<'_>,
            #[zbus(connection)] connection: &Connection,
        ) -> zbus::fdo::Result<OwnedObjectPath> {
            self.calls.fetch_add(1, Ordering::SeqCst);
            let token = <&str>::try_from(options.get("handle_token").unwrap()).unwrap();
            let sender = header.sender().unwrap();
            let path: OwnedObjectPath = format!(
                "/org/freedesktop/portal/desktop/request/{}/{token}",
                sender.trim_start_matches(':').replace('.', "_")
            )
            .try_into()
            .unwrap();
            let code = self.response.load(Ordering::SeqCst);
            if code != u32::MAX {
                let mut results = std::collections::HashMap::<&str, OwnedValue>::new();
                if code == 0 {
                    results.insert(
                        "uri",
                        zbus::zvariant::Value::from("file:///tmp/portal.png")
                            .try_into()
                            .unwrap(),
                    );
                }
                connection
                    .emit_signal(
                        Some(sender.as_str()),
                        &path,
                        "org.freedesktop.portal.Request",
                        "Response",
                        &(code, results),
                    )
                    .await?;
            }
            Ok(path)
        }
    }

    #[test]
    #[ignore = "requires a private session bus: dbus-run-session -- cargo test portal_request_lifecycle -- --ignored"]
    fn portal_request_lifecycle() {
        tauri::async_runtime::block_on(async {
            let response = Arc::new(AtomicU32::new(0));
            let calls = Arc::new(AtomicUsize::new(0));
            let service = zbus::connection::Builder::session()
                .unwrap()
                .name("org.freedesktop.portal.Desktop")
                .unwrap()
                .serve_at(
                    "/org/freedesktop/portal/desktop",
                    TestPortal {
                        response: response.clone(),
                        calls: calls.clone(),
                    },
                )
                .unwrap()
                .build()
                .await
                .unwrap();
            for code in [0, 1, 2, u32::MAX, 0] {
                response.store(code, Ordering::SeqCst);
                let client = Connection::session().await.unwrap();
                let observer = client.clone();
                let result = request(client, true, Duration::from_secs(1)).await;
                match code {
                    0 => assert_eq!(result.unwrap(), Some(PathBuf::from("/tmp/portal.png"))),
                    1 => assert!(result.unwrap().is_none()),
                    2 => assert!(result.unwrap_err().contains("denied")),
                    _ => assert!(result.unwrap_err().contains("timed out")),
                }
                timeout(Duration::from_secs(1), observer.closed())
                    .await
                    .unwrap();
            }
            assert_eq!(calls.load(Ordering::SeqCst), 5);
            service.close().await.unwrap();
        });
    }

    #[test]
    fn cancellation_does_not_require_a_screenshot_uri() {
        let result = screenshot_response(Err(ashpd::Error::Response(
            ashpd::desktop::ResponseError::Cancelled,
        )));
        assert!(result.unwrap().is_none());
    }

    #[test]
    fn preserves_permission_failure_instead_of_falling_back() {
        let result = screenshot_response(Err(ashpd::Error::Response(
            ashpd::desktop::ResponseError::Other,
        )));
        assert!(result.unwrap_err().contains("denied"));
    }

    #[test]
    fn accepts_only_local_screenshot_files() {
        assert_eq!(
            screenshot_path("file:///tmp/shot%20one.png").unwrap(),
            std::path::PathBuf::from("/tmp/shot one.png")
        );
        assert!(screenshot_path("https://example.com/shot.png").is_err());
        assert!(screenshot_path("file://example.com/shot.png").is_err());
        assert!(screenshot_path("file:///tmp/shot.png?other=1").is_err());
        assert!(screenshot_path("file:///tmp/shot.png#other").is_err());
    }
}
