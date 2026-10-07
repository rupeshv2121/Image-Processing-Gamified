function J = addPoissonNoise(I)
%ADDPOISSONNOISE Poisson (shot / photon) noise.
%   Light arrives as a random number of photons, so a pixel with expected
%   value lambda actually records a Poisson(lambda) count. The noise is
%   signal-dependent: variance = mean. Pixel values (0..255) are treated
%   as photon counts, as imnoise(uint8Image, 'poisson') does.

I = toDouble(I);
if hasIPT()
    J = toDouble(imnoise(toUint8(I), 'poisson'));
    return
end

lambda = I * 255;
counts = zeros(size(lambda));

% Large counts: normal approximation N(lambda, lambda)
big = lambda >= 20;
counts(big) = round(lambda(big) + sqrt(lambda(big)) .* randn(nnz(big), 1));

% Small counts: Knuth's algorithm (multiply uniforms until below e^-lambda)
small = find(~big);
limit = exp(-lambda(small));
k = zeros(size(small));
p = rand(size(small));
active = p > limit;
while any(active)
    k(active) = k(active) + 1;
    p(active) = p(active) .* rand(nnz(active), 1);
    active = p > limit;
end
counts(small) = k;

J = min(max(counts / 255, 0), 1);
end
