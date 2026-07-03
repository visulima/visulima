#!/bin/bash
# Long-running script that waits for user input at multiple points.
# Used to test the interactive input toggle (press 'i') in the vis TUI.

echo "=== Deploy Pipeline ==="
echo ""
echo "Step 1/4: Running pre-flight checks..."
sleep 2
echo "  [OK] Dependencies verified"
echo "  [OK] Tests passed"
echo "  [OK] Lint clean"
echo ""

echo "Step 2/4: Building artifacts..."
sleep 2
echo "  [OK] Bundle created (2.3 MB)"
echo "  [OK] Source maps generated"
echo ""

# First prompt
echo "Step 3/4: Ready to deploy to staging."
echo -n "Continue with deploy? (yes/no): "
read -r answer

if [ "$answer" != "yes" ]; then
    echo ""
    echo "Deploy cancelled by user."
    exit 1
fi

echo ""
echo "  Deploying to staging..."
sleep 2
echo "  [OK] Staging deploy complete"
echo ""

# Second prompt
echo "Step 4/4: Staging looks good."
echo -n "Promote to production? (yes/no): "
read -r answer

if [ "$answer" != "yes" ]; then
    echo ""
    echo "Production deploy skipped. Staging only."
    exit 0
fi

echo ""
echo "  Deploying to production..."
sleep 2
echo "  [OK] Production deploy complete"
echo ""
echo "=== All done! ==="
