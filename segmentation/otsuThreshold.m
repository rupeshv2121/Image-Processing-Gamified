function [BW, level, effectiveness] = otsuThreshold(I)
%OTSUTHRESHOLD Otsu's optimal global threshold (graythresh + imbinarize).
%   Chooses the threshold k that MAXIMISES the between-class variance
%
%       sigma_B^2(k) = (mu_T * omega(k) - mu(k))^2 / (omega(k) * (1 - omega(k)))
%
%   omega(k) = probability of class 1 (levels 0..k)
%   mu(k)    = cumulative mean up to k,  mu_T = global mean
%   effectiveness = sigma_B^2(k*) / sigma_T^2  (1 = perfectly bimodal)

G = toGray(I);
if hasIPT()
    [level, effectiveness] = graythresh(G);
    BW = imbinarize(G, level);
    return
end

counts = accumarray(double(toUint8(G(:))) + 1, 1, [256 1]);
p = counts / sum(counts);
levels = (0:255)';
omega = cumsum(p);
mu = cumsum(p .* levels);
muT = mu(end);
sigmaB2 = (muT * omega - mu).^2 ./ (omega .* (1 - omega));
sigmaB2(~isfinite(sigmaB2)) = 0;

maxVal = max(sigmaB2);
k = mean(find(sigmaB2 == maxVal)) - 1;    % average if several maxima
level = k / 255;
sigmaT2 = sum(((levels - muT).^2) .* p);
effectiveness = maxVal / max(sigmaT2, eps);
BW = G > level;
end
