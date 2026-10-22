function [f, history] = deconvolveImage(g, h, method, lambda, iterations, ref)
%DECONVOLVEIMAGE Restore an image blurred by a known PSF - in the SPATIAL domain.
%   [f, history] = deconvolveImage(g, h, method, lambda, iterations, ref)
%
%   method:
%     'inverse' - minimise ||h*f - g||^2. The iterative form of the inverse
%                 filter F = G/H: more iterations recover more detail but
%                 also amplify the noise without limit.
%     'wiener'  - minimise ||h*f - g||^2 + K ||f||^2  (lambda = K).
%                 Converges to the parametric Wiener filter
%                 F = H* G / (|H|^2 + K), K = noise-to-signal power ratio.
%     'cls'     - minimise ||h*f - g||^2 + gamma ||p*f||^2 with p the
%                 Laplacian (lambda = gamma): constrained least squares,
%                 F = H* G / (|H|^2 + gamma |P|^2) - penalises roughness.
%     'lucy'    - Richardson-Lucy (maximum likelihood for Poisson noise):
%                 f <- f .* (h' * (g ./ (h * f))). Stays non-negative.
%
%   inverse / wiener / cls solve the normal equations
%       (H'H + lambda R'R) f = H' g
%   with the conjugate-gradient method. Every step only needs convolutions
%   with h and its 180-degree rotation, so no Fourier transform is used.
%
%   ref (optional) - the true image; history(k) is then the PSNR after
%   iteration k, otherwise the RMS of the residual h*f - g.
%
%   Toolbox equivalents: deconvwnr(g, h, K), deconvreg(g, h), deconvlucy(g, h, n).

if nargin < 3 || isempty(method), method = 'wiener'; end
if nargin < 4 || isempty(lambda), lambda = 0.01; end
if nargin < 5 || isempty(iterations), iterations = 25; end
if nargin < 6, ref = []; end
g = toDouble(g);
iterations = max(1, round(iterations));
H  = @(x) filter2D(x, rot90(h, 2), 'symmetric');   % convolution with h
Ht = @(x) filter2D(x, h, 'symmetric');             % its adjoint: correlation with h
history = zeros(1, iterations);

switch lower(method)
    case 'lucy'
        f = max(g, 1e-6);
        for it = 1:iterations
            f = f .* Ht(g ./ max(H(f), 1e-6));
            history(it) = score(f);
        end
    case {'inverse', 'wiener', 'cls'}
        switch lower(method)
            case 'inverse'
                R = @(x) 0 * x;
                lambda = 0;
            case 'wiener'
                R = @(x) x;
            case 'cls'
                P = [0 1 0; 1 -4 1; 0 1 0];          % symmetric, so P' = P
                R = @(x) filter2D(filter2D(x, P, 'symmetric'), P, 'symmetric');
        end
        A = @(x) Ht(H(x)) + lambda * R(x);
        f = g;                                       % start from the degraded image
        r = Ht(g) - A(f);
        d = r;
        rr = sum(r(:).^2);
        for it = 1:iterations
            if rr < 1e-20
                history(it:end) = score(f);
                break
            end
            Ad = A(d);
            alpha = rr / sum(d(:) .* Ad(:));
            f = f + alpha * d;
            r = r - alpha * Ad;
            rrNew = sum(r(:).^2);
            d = r + (rrNew / rr) * d;
            rr = rrNew;
            history(it) = score(f);
        end
    otherwise
        error('ImageLab:invalidParameter', 'Unknown restoration method "%s".', method);
end
f = min(max(f, 0), 1);

    function s = score(x)
        if isempty(ref)
            res = H(x) - g;
            s = sqrt(mean(res(:).^2));
        else
            s = calculatePSNR(min(max(x, 0), 1), ref);
        end
    end
end
