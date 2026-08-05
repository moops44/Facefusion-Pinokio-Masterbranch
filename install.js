const path = require('path');

/**
 * Script to clean corrupted libcublas/libcudnn packages from Conda cache
 */
const cleanCorruptedPkgsScript = "import os, glob, shutil, sys; dirs = [os.path.abspath(os.path.join(sys.prefix, '../../../bin/miniforge/pkgs')), os.path.join(os.path.dirname(sys.executable), 'pkgs')]; [shutil.rmtree(f, ignore_errors=True) if os.path.isdir(f) else os.remove(f) for d in dirs if os.path.exists(d) for p in ['*libcublas*', '*libcudnn*'] for f in glob.glob(os.path.join(d, p))]; print('=== Conda cache cleaned ===')";

/**
 * Script to clean stale __pycache__ folders to prevent import errors when switching versions
 */
const cleanPycacheScript = "import os, shutil; [shutil.rmtree(os.path.join(r, d), ignore_errors=True) for r, ds, _ in os.walk('.') for d in ds if d == '__pycache__']; print('=== PyCache cleaned ===')";

function install(kernel)
{
	const { platform, gpu } = kernel;

	if (platform === 'linux' && gpu === 'amd')
	{
		return 'python install.py directml';
	}
	if (platform === 'win32' && gpu === 'amd')
	{
		return 'python install.py directml';
	}
	if ((platform === 'linux' || platform === 'win32') && gpu === 'intel')
	{
		return 'python install.py openvino';
	}
	if ((platform === 'linux' || platform === 'win32') && gpu === 'nvidia')
	{
		// Updated from 'cuda' to 'cuda@12' to match new install.py syntax
		return 'python install.py cuda@12';
	}
	return 'python install.py default';
}

module.exports = async kernel =>
{
	const config =
	{
		run:
		[
			{
				// Hard reset / wipe .env directory before starting
				method: 'fs.rm',
				params:
				{
					path: path.resolve(__dirname, '.env')
				}
			},
			{
				method: 'shell.run',
				params:
				{
					message: 'git clone https://github.com/facefusion/facefusion --branch master --single-branch',
					on:
					[
						{
							event: '/error:/i',
							break: false
						}
					]
				}
			},
			{
				method: 'shell.run',
				params:
				{
					message:
					[
						'git reset --hard',
						'git clean -fd',
						'git checkout master',
						'git pull',
						`python -c "${cleanPycacheScript}"`
					],
					path: 'facefusion',
					conda:
					{
						path: path.resolve(__dirname, '.env')
					},
					on:
					[
						{
							event: '/error:/i',
							break: false
						}
					]
				}
			},
			{
				method: 'fs.copy',
				params:
				{
					src: path.resolve(__dirname, 'install.py'),
					dest: path.resolve(__dirname, 'facefusion', 'install.py')
				}
			},
			{
				method: 'shell.run',
				params:
				{
					message: 'conda install conda=25.5.1 --yes'
				}
			},
			{
				method: 'shell.run',
				params:
				{
					message: [
						'conda clean --all --yes',
						`python -c "${cleanCorruptedPkgsScript}"`,
						'conda config --env --add channels conda-forge',
						'conda config --env --set channel_priority strict',
						'conda install -c conda-forge python=3.12 ffmpeg=7.0.2 libvorbis=1.3.7 gettext libintl glib --yes'
					],
					conda:
					{
						path: path.resolve(__dirname, '.env')
					}
				}
			},
			{
				when: '{{ (platform === "linux" || platform === "win32") && gpu === "intel" }}',
				method: 'shell.run',
				params:
				{
					message: 'conda install -c conda-forge openvino=2025.1.0 --yes',
					conda:
					{
						path: path.resolve(__dirname, '.env')
					}
				}
			},
			{
				when: '{{ (platform === "linux" || platform === "win32") && gpu === "nvidia" }}',
				method: 'shell.run',
				params:
				{
					message:
					[
						'conda install nvidia/label/cuda-12.9.1::cuda-runtime nvidia/label/cudnn-9.10.2::cudnn --force-reinstall --yes',
						'pip install tensorrt==10.12.0.36 --extra-index-url https://pypi.nvidia.com'
					],
					conda:
					{
						path: path.resolve(__dirname, '.env')
					}
				}
			},
			{
				method: 'shell.run',
				params:
				{
					message: install(kernel),
					path: 'facefusion',
					conda:
					{
						path: path.resolve(__dirname, '.env')
					},
					on:
					[
						{
							event: '/error:/i',
							break: false
						}
					]
				}
			},
			{
				when: '{{ platform === "win32" && gpu === "nvidia" }}',
				method: 'shell.run',
				params:
				{
					message:
					[
						'pip install nvidia-cublas-cu12 nvidia-cudnn-cu12 nvidia-cuda-runtime-cu12 nvidia-cuda-nvrtc-cu12 nvidia-cufft-cu11 nvidia-cufft-cu12',
						'python -c "import os, sys, shutil; env=sys.prefix; nv=os.path.join(env, \'Lib\', \'site-packages\', \'nvidia\'); lib_bin=os.path.join(env, \'Library\', \'bin\'); ort=os.path.join(env, \'Lib\', \'site-packages\', \'onnxruntime\', \'capi\'); os.makedirs(lib_bin, exist_ok=True); os.makedirs(ort, exist_ok=True); [(shutil.copy2(os.path.join(r, f), lib_bin), shutil.copy2(os.path.join(r, f), ort)) for r, d, fs in os.walk(nv) for f in fs if f.endswith(\'.dll\') if os.path.exists(nv)]; print(\'=== CUDA DLLs copied successfully ===\')"'
					],
					conda:
					{
						path: path.resolve(__dirname, '.env')
					}
				}
			},
			{
				method: 'input',
				params:
				{
					title: 'Installation completed',
					description: 'Return to the dashboard to start FaceFusion.'
				}
			}
		]
	};

	return config;
};