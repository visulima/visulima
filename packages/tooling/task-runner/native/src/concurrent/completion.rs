use super::types::ConcurrentCloseEvent;

/// Determines what constitutes a successful run.
#[derive(Debug, Clone)]
pub enum SuccessCondition {
    /// All commands must exit with code 0.
    All,
    /// Only the first command to close must succeed.
    First,
    /// Only the last command to close must succeed.
    Last,
    /// Only the specified command (by name or index) must succeed.
    Command(String),
    /// All commands except the specified one must succeed.
    NegatedCommand(String),
}

impl SuccessCondition {
    /// Parse a success condition from a string.
    /// Formats: "all", "first", "last", "command-<name>", "!command-<name>"
    pub fn parse(input: &str) -> Self {
        match input.trim().to_lowercase().as_str() {
            "all" => Self::All,
            "first" => Self::First,
            "last" => Self::Last,
            s if s.starts_with("!command-") => Self::NegatedCommand(s.trim_start_matches("!command-").to_string()),
            s if s.starts_with("command-") => Self::Command(s.trim_start_matches("command-").to_string()),
            _ => Self::All,
        }
    }

    /// Evaluate whether the run succeeded given the close events (in completion order).
    pub fn evaluate(&self, events: &[ConcurrentCloseEvent]) -> bool {
        if events.is_empty() {
            return true;
        }

        match self {
            Self::All => events.iter().all(|e| e.exit_code == 0),
            Self::First => events.first().map_or(true, |e| e.exit_code == 0),
            Self::Last => events.last().map_or(true, |e| e.exit_code == 0),
            Self::Command(target) => {
                let matching: Vec<_> = events.iter().filter(|e| Self::matches_target(e, target)).collect();

                if matching.is_empty() {
                    false
                } else {
                    matching.iter().all(|e| e.exit_code == 0)
                }
            }
            Self::NegatedCommand(target) => {
                events.iter().filter(|e| !Self::matches_target(e, target)).all(|e| e.exit_code == 0)
            }
        }
    }

    /// Check if a close event matches the target (by name or index string).
    fn matches_target(event: &ConcurrentCloseEvent, target: &str) -> bool {
        // Match by name
        if let Some(ref name) = event.name {
            if name == target {
                return true;
            }
        }
        // Match by index
        if let Ok(idx) = target.parse::<u32>() {
            return event.index == idx;
        }
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_event(index: u32, name: Option<&str>, exit_code: i32) -> ConcurrentCloseEvent {
        ConcurrentCloseEvent {
            index,
            command: format!("cmd-{}", index),
            name: name.map(|s| s.to_string()),
            exit_code,
            killed: false,
            duration_ms: 100.0,
        }
    }

    #[test]
    fn test_all_success() {
        let cond = SuccessCondition::All;
        let events = vec![make_event(0, None, 0), make_event(1, None, 0)];
        assert!(cond.evaluate(&events));
    }

    #[test]
    fn test_all_failure() {
        let cond = SuccessCondition::All;
        let events = vec![make_event(0, None, 0), make_event(1, None, 1)];
        assert!(!cond.evaluate(&events));
    }

    #[test]
    fn test_first() {
        let cond = SuccessCondition::First;
        let events = vec![make_event(0, None, 0), make_event(1, None, 1)];
        assert!(cond.evaluate(&events));
    }

    #[test]
    fn test_first_failure() {
        let cond = SuccessCondition::First;
        let events = vec![make_event(0, None, 1), make_event(1, None, 0)];
        assert!(!cond.evaluate(&events));
    }

    #[test]
    fn test_last() {
        let cond = SuccessCondition::Last;
        let events = vec![make_event(0, None, 1), make_event(1, None, 0)];
        assert!(cond.evaluate(&events));
    }

    #[test]
    fn test_command_by_name() {
        let cond = SuccessCondition::Command("server".to_string());
        let events = vec![make_event(0, Some("server"), 0), make_event(1, Some("client"), 1)];
        assert!(cond.evaluate(&events));
    }

    #[test]
    fn test_command_by_index() {
        let cond = SuccessCondition::Command("1".to_string());
        let events = vec![make_event(0, None, 1), make_event(1, None, 0)];
        assert!(cond.evaluate(&events));
    }

    #[test]
    fn test_negated_command() {
        let cond = SuccessCondition::NegatedCommand("server".to_string());
        let events = vec![make_event(0, Some("server"), 1), make_event(1, Some("client"), 0)];
        assert!(cond.evaluate(&events));
    }

    #[test]
    fn test_parse() {
        assert!(matches!(SuccessCondition::parse("all"), SuccessCondition::All));
        assert!(matches!(SuccessCondition::parse("first"), SuccessCondition::First));
        assert!(matches!(SuccessCondition::parse("last"), SuccessCondition::Last));
        assert!(matches!(SuccessCondition::parse("command-server"), SuccessCondition::Command(_)));
        assert!(matches!(SuccessCondition::parse("!command-server"), SuccessCondition::NegatedCommand(_)));
    }

    #[test]
    fn test_empty_events() {
        assert!(SuccessCondition::All.evaluate(&[]));
        assert!(SuccessCondition::First.evaluate(&[]));
        assert!(SuccessCondition::Last.evaluate(&[]));
    }

    #[test]
    fn test_command_not_found_returns_false() {
        let cond = SuccessCondition::Command("nonexistent".to_string());
        let events = vec![make_event(0, Some("server"), 0)];
        assert!(!cond.evaluate(&events));
    }

    #[test]
    fn test_command_multiple_matching() {
        // Two commands with the same name, both must succeed
        let cond = SuccessCondition::Command("worker".to_string());
        let events = vec![make_event(0, Some("worker"), 0), make_event(1, Some("worker"), 0)];
        assert!(cond.evaluate(&events));
    }

    #[test]
    fn test_command_multiple_matching_one_fails() {
        let cond = SuccessCondition::Command("worker".to_string());
        let events = vec![make_event(0, Some("worker"), 0), make_event(1, Some("worker"), 1)];
        assert!(!cond.evaluate(&events));
    }

    #[test]
    fn test_negated_all_excluded() {
        // If all events match the target, no events remain to check -- vacuous truth
        let cond = SuccessCondition::NegatedCommand("only".to_string());
        let events = vec![make_event(0, Some("only"), 1)];
        assert!(cond.evaluate(&events));
    }

    #[test]
    fn test_all_single_failure() {
        let cond = SuccessCondition::All;
        let events = vec![make_event(0, None, 1)];
        assert!(!cond.evaluate(&events));
    }

    #[test]
    fn test_all_single_success() {
        let cond = SuccessCondition::All;
        let events = vec![make_event(0, None, 0)];
        assert!(cond.evaluate(&events));
    }

    #[test]
    fn test_parse_case_insensitive() {
        assert!(matches!(SuccessCondition::parse("ALL"), SuccessCondition::All));
        assert!(matches!(SuccessCondition::parse("First"), SuccessCondition::First));
        assert!(matches!(SuccessCondition::parse("LAST"), SuccessCondition::Last));
    }

    #[test]
    fn test_parse_with_whitespace() {
        assert!(matches!(SuccessCondition::parse("  all  "), SuccessCondition::All));
    }

    #[test]
    fn test_parse_unknown_defaults_to_all() {
        assert!(matches!(SuccessCondition::parse("unknown"), SuccessCondition::All));
        assert!(matches!(SuccessCondition::parse(""), SuccessCondition::All));
    }

    #[test]
    fn test_killed_processes_have_nonzero_exit() {
        let cond = SuccessCondition::All;
        let mut event = make_event(0, None, -9);
        event.killed = true;
        assert!(!cond.evaluate(&[event]));
    }

    #[test]
    fn test_command_by_index_with_named_events() {
        // Index matching should work even when events have names
        let cond = SuccessCondition::Command("0".to_string());
        let events = vec![make_event(0, Some("server"), 0), make_event(1, Some("client"), 1)];
        assert!(cond.evaluate(&events));
    }

    #[test]
    fn test_last_with_many_events() {
        let cond = SuccessCondition::Last;
        let events = vec![
            make_event(0, None, 1),
            make_event(1, None, 1),
            make_event(2, None, 1),
            make_event(3, None, 0), // last one succeeds
        ];
        assert!(cond.evaluate(&events));
    }
}
