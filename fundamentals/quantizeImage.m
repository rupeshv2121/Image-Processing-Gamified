function [J, levels] = quantizeImage(I, bits)
%QUANTIZEIMAGE Reduce the number of grey levels to 2^bits (quantisation).
%       q = floor(r * 2^bits),  clipped to 0..2^bits-1
%       s = q / (2^bits - 1)
%   With few bits, smooth gradients turn into visible bands ("false
%   contouring").

if nargin < 2 || isempty(bits), bits = 4; end
if bits < 1 || bits > 8 || bits ~= round(bits)
    error('ImageLab:invalidParameter', 'Bits must be an integer from 1 to 8.');
end
levels = 2^bits;
I = toDouble(I);
q = min(floor(I * levels), levels - 1);
J = q / (levels - 1);
end
