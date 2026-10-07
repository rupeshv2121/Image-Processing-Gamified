function ImageLab()
%IMAGELAB Start ImageLab - Interactive Image Processing Laboratory.
%   Type  ImageLab  in the MATLAB Command Window (with this folder as the
%   current folder). This function:
%     1. adds all ImageLab folders to the MATLAB path,
%     2. shares THIS MATLAB session (matlab.engine.shareEngine),
%     3. starts the small bridge server, which connects back to this session,
%     4. opens the user interface in the browser.
%
%   All image processing then runs here, in this MATLAB session, using the
%   functions in algorithms/, noise/, histogram/, metrics/, segmentation/ ...
%   Close the "ImageLab server" window to stop the interface.
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
server = fullfile(root, 'server', 'server.py');

if ispc
    cmd = sprintf('start "ImageLab server" /min "%s" "%s" --connect %s', python, server, name);
else
    cmd = sprintf('"%s" "%s" --connect %s &', python, server, name);
end
status = system(cmd);
if status ~= 0
    error('ImageLab:server', ['Could not start the ImageLab server. Run setup_imagelab.bat ' ...
        'once to install the MATLAB Engine API for Python.']);
end

fprintf('\n  ImageLab is starting at http://localhost:8765\n');
fprintf('  MATLAB session "%s" is shared - all image processing runs here.\n', name);
fprintf('  Image Processing Toolbox: %s\n\n', yesno(hasIPT()));
end

function s = yesno(tf)
if tf, s = 'installed'; else, s = 'not installed (manual implementations are used)'; end
end
