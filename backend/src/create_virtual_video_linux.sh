#!/bin/bash
sudo apt install v4l2loopback-dkms
sudo modprobe -r v4l2loopback
sudo modprobe v4l2loopback devices=1 video_nr=1 card_label="SIM-CAM1" exclusive_caps=1
ls /sys/devices/virtual/video4linux/
