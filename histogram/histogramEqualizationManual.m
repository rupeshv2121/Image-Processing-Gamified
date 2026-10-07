function [J, mapping] = histogramEqualizationManual(G)
%HISTOGRAMEQUALIZATIONMANUAL Histogram equalisation from first principles.
%   For a grey level r_k the output level is
%
%       s_k = (L-1) * sum_{j=0..k} p(r_j)      (L = 256)
%
%   i.e. the scaled cumulative distribution function (CDF). Frequent grey
%   levels are spread apart, so the histogram becomes (roughly) flat and the
%   contrast increases.
%
%   Steps: 1) histogram  2) probabilities p = n_k / N  3) CDF
%          4) mapping s_k = round(255*CDF)  5) replace every pixel by s_k

G = toUint8(toGray(G));
counts  = accumarray(double(G(:)) + 1, 1, [256 1]);   % 1) histogram
p       = counts / numel(G);                          % 2) probabilities
cdf     = cumsum(p);                                  % 3) CDF
mapping = round(255 * cdf);                           % 4) transfer function
J       = mapping(double(G) + 1) / 255;               % 5) look-up
J       = reshape(J, size(G));
end
