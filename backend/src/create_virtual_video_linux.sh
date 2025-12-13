#!/bin/bash

# --- Configuration ---
# The specific card label we are looking for
TARGET_CARD_LABEL="SIM-CAM1"

# The device file that contains the card label (standard location for v4l2loopback)
V4L2_LOOPBACK_CONTROL_FILE="/sys/module/v4l2loopback/parameters/card_label"

# --- Function to Re-create All Drivers ---
# This function encapsulates the logic to load the complete set of drivers
recreate_drivers() {
    echo "Recreating ALL v4l2loopback devices..."
    # 1. Remove the current module instances (if any are loaded)
    sudo modprobe -r v4l2loopback

    # 2. Load the module with the full configuration
    sudo modprobe v4l2loopback \
        devices=1 \
        card_label="$TARGET_CARD_LABEL" \
        exclusive_caps=1

    # Check if the modprobe was successful
    if [ $? -eq 0 ]; then
        echo "Successfully created the following virtual devices:"
        # List the created devices for verification
        ls /sys/devices/virtual/video4linux/
    else
        echo "Error: Failed to load v4l2loopback module."
    fi
}

# --- Main Logic ---

echo "Checking for existing v4l2loopback drivers..."

# Check if the v4l2loopback module is loaded at all
if ! lsmod | grep -q v4l2loopback; then
    echo "v4l2loopback module is NOT loaded. Proceeding to create drivers."
    recreate_drivers
    echo "Script complete."
    exit 0
fi

# Check if the TARGET_CARD_LABEL exists in the loaded module's parameters
# The 'cat' output will look something like "DE-CAM1,SIM-CAM1,DE-TRK,DE-RPI,DE-THERMAL"
if sudo cat "$V4L2_LOOPBACK_CONTROL_FILE" | grep -q "$TARGET_CARD_LABEL"; then
    echo "**Found** the virtual device with label: **$TARGET_CARD_LABEL**."
    echo "No changes required."
    echo "Script complete."
    exit 0
fi

echo "The target device '$TARGET_CARD_LABEL' was **NOT found**. Recreating drivers to include it."
recreate_drivers
echo "Script complete."