function J = colorEnhance(I, space, channel, operation, amount)
%COLORENHANCE Enhance a single channel of a colour model and convert back.
%   J = colorEnhance(I, space, channel, operation, amount)
%
%   space     : 'rgb' | 'hsv' | 'hsi' | 'cmy'
%   channel   : 1, 2 or 3
%   operation : 'gain'     multiply the channel by amount (e.g. S x 1.5 = more vivid)
%               'equalize' histogram-equalise the channel
%               'gamma'    channel .^ amount
%
%   Examples: boost saturation (hsv, 2, gain 1.5); equalise brightness
%   without changing hue (hsv, 3, equalize); white balance (rgb, 3, gain 0.9).

if nargin < 5 || isempty(amount), amount = 1.3; end
I = toDouble(I);
if size(I, 3) ~= 3
    error('ImageLab:notColor', 'Colour enhancement needs an RGB image.');
end
if ~ismember(channel, 1:3)
    error('ImageLab:invalidParameter', 'Channel must be 1, 2 or 3.');
end

% forward transform, with every channel normalised to [0,1]
switch lower(space)
    case 'rgb',   C = I;
    case 'hsv',   C = rgb2hsv(I);
    case 'hsi',   C = rgbToHsi(I);
    case 'cmy',   C = 1 - I;
    otherwise
        error('ImageLab:invalidParameter', 'Unknown colour space "%s".', space);
end

X = C(:,:,channel);
switch lower(operation)
    case 'gain'
        X = X * amount;
    case 'equalize'
        X = histogramEqualizationManual(X);
    case 'gamma'
        X = X .^ amount;
    otherwise
        error('ImageLab:invalidParameter', 'Unknown operation "%s".', operation);
end
if any(strcmpi(space, {'hsv', 'hsi'})) && channel == 1
    X = mod(X, 1);                           % hue is circular
end
C(:,:,channel) = min(max(X, 0), 1);

% inverse transform
switch lower(space)
    case 'rgb',   J = C;
    case 'hsv',   J = hsv2rgb(C);
    case 'hsi',   J = hsiToRgb(C);
    case 'cmy',   J = 1 - C;
end
J = min(max(J, 0), 1);
end
