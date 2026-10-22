function [J, mapping] = histogramMatching(I, target)
%HISTOGRAMMATCHING Histogram matching (specification) to a desired histogram.
%   [J, mapping] = histogramMatching(I, target)
%   target  - 256-element desired histogram (any scale), or a reference image
%   mapping - 256-element look-up table r -> z (0..255)
%
%   Algorithm (Gonzalez & Woods):
%     1. s = T(r) = (L-1) * CDF of the input      (equalise the input)
%     2. G(z)     = (L-1) * CDF of the target     (equalise the target)
%     3. for every s choose the smallest z with G(z) >= s,  z = G^-1(s)
%   Colour images are matched on the brightness (V) only.
%       J = histeq(I, target);          % toolbox
%       J = imhistmatch(I, refImage);   % toolbox, reference image

I = toDouble(I);
if numel(target) ~= 256
    target = imhistManual(toGray(target));      % a reference image
end
target = double(target(:));
if sum(target) <= 0
    error('ImageLab:invalidParameter', 'The target histogram is empty.');
end
G = cumsum(target) / sum(target);                % target CDF

if size(I, 3) == 3
    hsv = rgb2hsv(I);
    [hsv(:,:,3), mapping] = matchGray(hsv(:,:,3), G);
    J = hsv2rgb(hsv);
else
    [J, mapping] = matchGray(I, G);
end
end

function [J, mapping] = matchGray(X, G)
counts = imhistManual(X);
T = cumsum(counts) / sum(counts);                % input CDF
mapping = zeros(256, 1);
for r = 1:256
    z = find(G >= T(r) - 1e-12, 1, 'first');
    mapping(r) = z - 1;
end
J = mapping(round(X * 255) + 1) / 255;
J = reshape(J, size(X));
end
