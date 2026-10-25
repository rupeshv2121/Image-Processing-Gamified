function ImageLab(mode)
%IMAGELAB Start ImageLab - Interactive Image Processing Laboratory.
%   Type  ImageLab  in the MATLAB Command Window (with this folder as the
%   current folder). This function:
%     1. adds all ImageLab folders to the MATLAB path,
%     2. shares THIS MATLAB session (matlab.engine.shareEngine),
%     3. starts the ImageLab backend (backend/, FastAPI), which connects back
%        to this session for all image processing,
%     4. opens the user interface in the browser.
%
%   All image processing then runs here, in this MATLAB session, using the
%   functions in algorithms/, noise/, histogram/, metrics/, segmentation/ ...
%   Close the "ImageLab server" window to stop the interface.
%
%   ImageLab('lan')  classroom network mode: students sign in on their own
%   devices and use the labs, quizzes and the live quiz (the Code Lab and
%   teacher mode stay on this computer).
%
%   Requirements: Python 3.9-3.12 with the MATLAB Engine API
%   (run setup_imagelab.bat once), see README.md.

root = ilab_setup();
generateSampleImages(false);
ilab_store('init', fullfile(root, 'runtime', 'images'));

if ~matlab.engine.isEngineShared
    matlab.engine.shareEngine('ImageLab');
end
name = matlab.engine.engineName;

python = fullfile(root, '.venv', 'Scripts', 'python.exe');
if ~isfile(python)
    python = 'python';
end
backend = fullfile(root, 'backend');          % python -m imagelab runs from here
lan = nargin > 0 && strcmpi(mode, 'lan');
extra = '';
if lan, extra = ' --lan'; end

if ispc
    cmd = sprintf('start "ImageLab server" /min /D "%s" "%s" -m imagelab --connect %s%s', backend, python, name, extra);
else
    cmd = sprintf('cd "%s" && "%s" -m imagelab --connect %s%s &', backend, python, name, extra);
end
status = system(cmd);
if status ~= 0
    error('ImageLab:server', ['Could not start the ImageLab server. Run setup_imagelab.bat ' ...
        'once to install the MATLAB Engine API for Python.']);
end

fprintf('\n  ImageLab is starting at http://localhost:8765\n');
fprintf('  MATLAB session "%s" is shared - all image processing runs here.\n', name);
fprintf('  Image Processing Toolbox: %s\n\n', yesno(hasIPT()));
if lan
    fprintf('  Classroom network mode: the server window shows the address students open.\n\n');
end
end

function s = yesno(tf)
if tf, s = 'installed'; else, s = 'not installed (manual implementations are used)'; end
end
