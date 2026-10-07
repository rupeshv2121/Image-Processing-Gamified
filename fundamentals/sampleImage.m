function [display, small] = sampleImage(I, factor)
%SAMPLEIMAGE Spatial sampling: keep every FACTOR-th pixel.
%       small = I(1:factor:end, 1:factor:end, :)
%   To compare at the same size, each sample is repeated factor x factor
%   times (nearest-neighbour), which shows the blocky "checkerboard" effect
%   of under-sampling.

if nargin < 2 || isempty(factor), factor = 4; end
if factor < 1 || factor ~= round(factor)
    error('ImageLab:invalidParameter', 'The sampling factor must be a positive integer.');
end
I = toDouble(I);
small = I(1:factor:end, 1:factor:end, :);
display = repelem(small, factor, factor);
display = display(1:size(I, 1), 1:size(I, 2), :);
end
