function root = ilab_setup()
%ILAB_SETUP Add all ImageLab MATLAB folders to the path.
%   Run this once per MATLAB session (start_imagelab and the tests call it
%   automatically). Returns the project root folder.

root = fileparts(mfilename('fullpath'));
folders = {'core', 'algorithms', 'noise', 'histogram', 'metrics', ...
           'segmentation', 'restoration', 'steps', 'color', 'fundamentals', 'games', ...
           'experiments', 'reports', 'api', fullfile('api', 'handlers'), 'codelab', 'migration'};
for k = 1:numel(folders)
    addpath(fullfile(root, folders{k}));
end
addpath(root);
end
