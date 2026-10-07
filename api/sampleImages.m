function out = sampleImages(action, name)
%SAMPLEIMAGES Locate the sample images used by ImageLab.
%   list = sampleImages('list')        names and descriptions of all samples
%   file = sampleImages('path', name)  full path to a sample image
%
%   MATLAB's own images (peppers.png, corn.tif) are always available.
%   The Image Processing Toolbox images (cameraman.tif, coins.png, pout.tif,
%   saturn.png, ...) are used when the toolbox is installed. ImageLab also
%   generates teaching images in sample_images/ (see generateSampleImages).

root = fileparts(fileparts(mfilename('fullpath')));
localDir = fullfile(root, 'sample_images');

catalog = {
    'peppers.png',      'Colour photo - the main demo image';
    'cameraman.tif',    'Classic grayscale test image';
    'coins.png',        'Coins on a dark background - segmentation';
    'pout.tif',         'Low-contrast portrait - histogram processing';
    'saturn.png',       'Planet with rings - edges';
    'rice.png',         'Rice grains with uneven lighting - adaptive threshold';
    'moon.tif',         'Lunar surface - sharpening';
    'corn.tif',         'Corn (MATLAB built-in)';
    'lowcontrast.png',  'Generated: low-contrast scene - histogram lab';
    'shapes.png',       'Generated: geometric shapes - edges & segmentation';
    'gradient.png',     'Generated: smooth ramp - quantisation & false contours';
    'lines.png',        'Generated: thin lines and points - line/point detection';
    'unevenlight.png',  'Generated: blobs under uneven lighting - adaptive threshold'};

switch action
    case 'list'
        out = struct('name', {}, 'description', {});
        for k = 1:size(catalog, 1)
            if ~isempty(locate(catalog{k, 1}, localDir))
                out(end+1) = struct('name', catalog{k, 1}, 'description', catalog{k, 2}); %#ok<AGROW>
            end
        end
    case 'path'
        out = locate(name, localDir);
        if isempty(out)
            error('ImageLab:missingSample', ...
                'Sample image "%s" was not found. It needs the Image Processing Toolbox.', name);
        end
    otherwise
        error('ImageLab:internal', 'Unknown action "%s".', action);
end
end

function file = locate(name, localDir)
file = '';
if isfile(fullfile(localDir, name))
    file = fullfile(localDir, name);
    return
end
w = which(name);
if ~isempty(w) && isfile(w)
    file = w;
end
end
