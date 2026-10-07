function [G, mag] = gradientSharpen(I, operator, weight)
%GRADIENTSHARPEN Sharpening with a first-derivative (gradient) operator.
%       mag = |grad f| = sqrt(gx^2 + gy^2)   (Sobel or Prewitt)
%       G   = f + weight * mag
%   Edges have a large gradient so they get brighter, flat areas are unchanged.

if nargin < 2 || isempty(operator), operator = 'sobel'; end
if nargin < 3 || isempty(weight), weight = 0.5; end
I = toDouble(I);

switch lower(operator)
    case 'sobel',   Kx = [-1 0 1; -2 0 2; -1 0 1] / 4;
    case 'prewitt', Kx = [-1 0 1; -1 0 1; -1 0 1] / 3;
    otherwise
        error('ImageLab:invalidParameter', 'Operator must be sobel or prewitt.');
end
Ky = Kx';
gray = toGray(I);
mag = sqrt(filter2D(gray, Kx).^2 + filter2D(gray, Ky).^2);
G = min(max(I + weight * mag, 0), 1);       % same boost added to every channel
end
