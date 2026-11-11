#!/bin/sh
# Demo test runner: always fails, so model-coach can show the escalation ladder.
echo "running 12 tests..."
echo "FAIL orders.test: db connection refused (pg-primary:5432)"
echo "3 failed, 9 passed"
exit 1
