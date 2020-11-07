#!/bin/bash


python3  ~/TDisk/out_gits/ardupilot/Tools/autotest/sim_vehicle.py -j4 -v ArduCopter    -M --map --console --instance 70 --out=udpout:127.0.0.1:16450  --out=udpout:192.168.1.139:14450  --add-param-file=./quadPlus_2.parm

