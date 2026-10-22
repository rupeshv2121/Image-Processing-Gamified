function t = textureDescriptors(G, mask)
%TEXTUREDESCRIPTORS Statistical texture measures of a region (Gonzalez & Woods).
%   t = textureDescriptors(G, mask) uses the histogram p(z_i) of the grey
%   levels inside mask (default: the whole image), with z in 0..255:
%     mean          m  = sum z p(z)                    average intensity
%     std           sigma = sqrt(mu2)                  average contrast
%     smoothness    R  = 1 - 1/(1 + sigma^2/(L-1)^2)  0 for a constant region
%     thirdMoment   mu3 / (L-1)^2                      skewness of the histogram
%     uniformity    U  = sum p(z)^2                    1 for a constant region
%     entropy       e  = -sum p log2 p                 randomness
%   Smooth, coarse and regular textures give clearly different values.

if nargin < 2 || isempty(mask), mask = true(size(G)); end
z = round(255 * toGray(G));
v = z(logical(mask));
if isempty(v)
    error('ImageLab:invalidParameter', 'The region is empty.');
end
p = accumarray(v(:) + 1, 1, [256 1]) / numel(v);
levels = (0:255)';
m = sum(levels .* p);
mu2 = sum((levels - m).^2 .* p);
mu3 = sum((levels - m).^3 .* p);
nz = p(p > 0);
t = struct('mean', m, 'std', sqrt(mu2), ...
    'smoothness', 1 - 1 / (1 + mu2 / 255^2), ...
    'thirdMoment', mu3 / 255^2, ...
    'uniformity', sum(p.^2), ...
    'entropy', -sum(nz .* log2(nz)));
end
