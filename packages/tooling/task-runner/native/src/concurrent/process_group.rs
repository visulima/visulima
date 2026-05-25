/// Platform-specific process tree management.
///
/// Unix: spawn children in new process groups via `setsid`, kill via `killpg`.
/// Windows: assign children to Job Objects, terminate via `TerminateJobObject`.

#[cfg(unix)]
mod unix {
    use std::io;

    use nix::libc;
    use nix::sys::signal::{self, Signal};
    use nix::unistd::Pid;

    /// Pre-exec hook: call `setsid()` to create a new session/process group.
    /// Must be called inside `Command::pre_exec` (unsafe).
    pub unsafe fn pre_exec_setsid() -> io::Result<()> {
        if libc::setsid() == -1 {
            return Err(io::Error::last_os_error());
        }
        Ok(())
    }

    /// Kill an entire process group by PID.
    /// The PID is used as the PGID (since we called setsid).
    pub fn kill_process_group(pid: u32, signal_name: &str) -> io::Result<()> {
        let sig = parse_signal(signal_name).unwrap_or(Signal::SIGTERM);
        let pgid = Pid::from_raw(-(pid as i32));
        signal::kill(pgid, sig).map_err(|e| io::Error::new(io::ErrorKind::Other, e))
    }

    fn parse_signal(name: &str) -> Option<Signal> {
        match name.to_uppercase().as_str() {
            "SIGTERM" | "TERM" => Some(Signal::SIGTERM),
            "SIGKILL" | "KILL" => Some(Signal::SIGKILL),
            "SIGINT" | "INT" => Some(Signal::SIGINT),
            "SIGHUP" | "HUP" => Some(Signal::SIGHUP),
            "SIGQUIT" | "QUIT" => Some(Signal::SIGQUIT),
            _ => None,
        }
    }
}

#[cfg(windows)]
mod windows {
    use std::io;

    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::System::Console::{GenerateConsoleCtrlEvent, CTRL_BREAK_EVENT};
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation, SetInformationJobObject,
        TerminateJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };
    use windows_sys::Win32::System::Threading::{OpenProcess, PROCESS_SET_QUOTA, PROCESS_TERMINATE};

    /// Send `CTRL_BREAK_EVENT` to the process group rooted at `pid`.
    ///
    /// Requires the child to have been spawned with `CREATE_NEW_PROCESS_GROUP`
    /// — only then does the child have its own group ID equal to its PID, so a
    /// targeted `GenerateConsoleCtrlEvent` reaches the child + its descendants
    /// without also signalling our parent console.
    ///
    /// Note: `CTRL_C_EVENT` is silently ignored by processes in a new process
    /// group (Microsoft documents this), so we use `CTRL_BREAK_EVENT` for the
    /// graceful path. Well-behaved CLIs handle Ctrl+Break the same as Ctrl+C.
    pub fn graceful_shutdown(pid: u32) -> io::Result<()> {
        let result = unsafe { GenerateConsoleCtrlEvent(CTRL_BREAK_EVENT, pid) };
        if result == 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(())
    }

    /// A Windows Job Object handle that ensures child process tree cleanup.
    /// When the Job Object is dropped, all assigned processes are terminated.
    pub struct JobObject {
        handle: HANDLE,
    }

    impl JobObject {
        pub fn new() -> io::Result<Self> {
            let handle = unsafe { CreateJobObjectW(std::ptr::null(), std::ptr::null()) };
            if handle.is_null() {
                return Err(io::Error::last_os_error());
            }

            // Configure: kill all processes when the job object is closed
            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = unsafe { std::mem::zeroed() };
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

            let result = unsafe {
                SetInformationJobObject(
                    handle,
                    JobObjectExtendedLimitInformation,
                    &info as *const _ as *const _,
                    std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                )
            };

            if result == 0 {
                unsafe { CloseHandle(handle) };
                return Err(io::Error::last_os_error());
            }

            Ok(Self { handle })
        }

        /// Assign a process to this Job Object by PID.
        /// Opens the process handle, assigns it, then closes the handle.
        pub fn assign_process_by_pid(&self, pid: u32) -> io::Result<()> {
            // Minimum permissions needed for Job Object assignment + termination
            let process_handle = unsafe { OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, 0, pid) };
            if process_handle == INVALID_HANDLE_VALUE || process_handle.is_null() {
                return Err(io::Error::last_os_error());
            }

            let result = unsafe { AssignProcessToJobObject(self.handle, process_handle) };
            unsafe { CloseHandle(process_handle) };

            if result == 0 {
                return Err(io::Error::last_os_error());
            }
            Ok(())
        }

        pub fn terminate(&self, exit_code: u32) -> io::Result<()> {
            let result = unsafe { TerminateJobObject(self.handle, exit_code) };
            if result == 0 {
                return Err(io::Error::last_os_error());
            }
            Ok(())
        }
    }

    impl Drop for JobObject {
        fn drop(&mut self) {
            unsafe { CloseHandle(self.handle) };
        }
    }

    // SAFETY: The Job Object handle is thread-safe in Windows.
    unsafe impl Send for JobObject {}
    unsafe impl Sync for JobObject {}
}

/// Kill a process tree by PID with the given signal.
pub fn kill_tree(pid: u32, signal: &str) -> std::io::Result<()> {
    #[cfg(unix)]
    {
        unix::kill_process_group(pid, signal)
    }

    #[cfg(windows)]
    {
        // On Windows, if we have a Job Object, termination happens via the Job.
        // This fallback kills just the process if no Job Object is available.
        let _ = signal;
        let output = std::process::Command::new("taskkill").args(["/F", "/T", "/PID", &pid.to_string()]).output()?;
        if output.status.success() {
            Ok(())
        } else {
            Err(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("taskkill failed: {}", String::from_utf8_lossy(&output.stderr)),
            ))
        }
    }
}

#[cfg(unix)]
pub use unix::pre_exec_setsid;

#[cfg(windows)]
pub use windows::{graceful_shutdown, JobObject};
