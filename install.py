#!/usr/bin/env python3

import os
import sys

os.environ['SYSTEM_VERSION_COMPAT'] = '0'

# Filter out legacy Pinokio argument before launching installer
if '--onnxruntime' in sys.argv:
    sys.argv.remove('--onnxruntime')

from facefusion import installer

if __name__ == '__main__':
	installer.cli()