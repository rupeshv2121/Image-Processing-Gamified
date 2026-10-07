function root = ilab_setup()
%ILAB_SETUP Add all ImageLab MATLAB folders to the path.
%   Run this once per MATLAB session (start_imagelab and the tests call it
%   automatically). Returns the project root folder.

root = fileparts(mfilename('fullpath'));
folders = {'core', 'algorithms', 'noise', 'histogram', 'metrics', ...
           'segmentation', 'color', 'fundamentals', 'quizzes', ...
           'experiments', 'reports', 'api'};
for k = 1:numel(folders)
    addpath(fullfile(root, folders{k}));
end
addpath(root);
end
