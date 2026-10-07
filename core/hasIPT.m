function tf = hasIPT()
%HASIPT True when the Image Processing Toolbox is installed and licensed.
%   ImageLab calls toolbox functions (imfilter, medfilt2, histeq, edge, ...)
%   when they are available and falls back to its own base-MATLAB
%   implementations otherwise, so every lab works on a plain MATLAB install.
%
%   Set the environment variable ILAB_FORCE_MANUAL=1 to simulate a missing
%   toolbox (useful for testing the fallback code paths).

persistent installed
if isempty(installed)
    installed = exist('imfilter', 'file') == 2 && ...
                exist('medfilt2', 'file') == 2 && ...
                license('test', 'image_toolbox');
end
tf = installed && ~strcmp(getenv('ILAB_FORCE_MANUAL'), '1');
end
