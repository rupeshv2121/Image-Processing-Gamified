function [J, noiseVar] = adaptiveLocalFilter(I, k, noiseVar)
%ADAPTIVELOCALFILTER Adaptive local noise-reduction filter (Wiener-style).
%   [J, noiseVar] = adaptiveLocalFilter(I, k, noiseVar) - like wiener2(I, [k k], noiseVar).
%
%       f^(x,y) = g(x,y) - (σ²η / σ²L) · [ g(x,y) - mL ]
%
%   g        noisy pixel
%   mL, σ²L  local mean and variance in the k-by-k window
%   σ²η      noise variance (estimated as the mean of all local variances
%            when not given - the same estimate wiener2 uses)
%
%   Flat area  (σ²L ≈ σ²η): output ≈ local mean    -> strong smoothing
%   Edge/detail (σ²L >> σ²η): output ≈ g            -> detail is kept
%   The ratio σ²η / σ²L is clipped to 1 so the output never overshoots.

if nargin < 2 || isempty(k), k = 5; end
if nargin < 3 || isempty(noiseVar) || noiseVar <= 0, noiseVar = []; end
validateKernelSize(k);
I = toDouble(I);
box = ones(k) / k^2;
mL = filter2D(I, box, 'symmetric');                      % local mean
varL = max(filter2D(I.^2, box, 'symmetric') - mL.^2, 0); % local variance E[g²] - mL²
if isempty(noiseVar)
    noiseVar = mean(varL(:));
end
ratio = min(noiseVar ./ max(varL, eps), 1);
J = I - ratio .* (I - mL);
end
