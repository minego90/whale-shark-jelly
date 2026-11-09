#!/bin/bash
# usage: cv.sh out yaw pitch tx ty tz dist [extraJS]
timeout 150 python3 "$(dirname "$0")/snap.py" $1 4 "(()=>{const c=window.__jelly.cam;c.yaw=$2;c.pitch=$3;c.tx=$4;c.ty=$5;c.tz=$6;c.dist=$7;window.__jelly.ST.kelp=false;$8})()" 900 600 3 '#norender' 2>&1 | tail -1
