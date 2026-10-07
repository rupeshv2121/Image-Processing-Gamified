function [channels, names, converted] = colorChannels(I, space)
%COLORCHANNELS Split an image into the channels of a colour model.
%   [channels, names, converted] = colorChannels(I, space)
%   space: 'rgb' | 'hsv' | 'ycbcr' | 'lab' | 'gray'
%   channels{k} is scaled to [0,1] for display; converted is the raw image
%   in the chosen colour space.

I = toDouble(I);
if size(I, 3) ~= 3 && ~strcmpi(space, 'gray')
    error('ImageLab:notColor', 'Colour models need an RGB image. Load a colour image first.');
end

switch lower(space)
    case 'rgb'
        converted = I;
        names = {'Red (R)', 'Green (G)', 'Blue (B)'};
        channels = {I(:,:,1), I(:,:,2), I(:,:,3)};
    case 'hsv'
        converted = rgb2hsv(I);              % base MATLAB
        names = {'Hue (H)', 'Saturation (S)', 'Value (V)'};
        channels = {converted(:,:,1), converted(:,:,2), converted(:,:,3)};
    case 'ycbcr'
        if hasIPT(), converted = rgb2ycbcr(I); else, converted = rgbToYCbCr(I); end
        names = {'Luma (Y)', 'Blue diff (Cb)', 'Red diff (Cr)'};
        channels = {converted(:,:,1), converted(:,:,2), converted(:,:,3)};
    case 'lab'
        if hasIPT(), converted = rgb2lab(I); else, converted = rgbToLab(I); end
        names = {'Lightness (L*)', 'Green-Red (a*)', 'Blue-Yellow (b*)'};
        channels = {converted(:,:,1) / 100, ...
                    (converted(:,:,2) + 128) / 255, ...
                    (converted(:,:,3) + 128) / 255};
    case 'gray'
        converted = toGray(I);
        names = {'Gray (Y)'};
        channels = {converted};
    otherwise
        error('ImageLab:invalidParameter', 'Unknown colour space "%s".', space);
end
channels = cellfun(@(c) min(max(c, 0), 1), channels, 'UniformOutput', false);
end
