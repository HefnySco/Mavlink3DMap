#!/bin/bash


python3  ~/TDisk/out_gits/ardupilot/Tools/autotest/sim_vehicle.py  -j4 -v ArduPlane  -M --map --console --instance 80 --out=udpout:127.0.0.1:14550 --out=udpout:192.168.1.139:16450
