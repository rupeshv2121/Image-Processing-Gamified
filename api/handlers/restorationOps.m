function data = restorationOps(op, p)
%RESTORATIONOPS Linear, position-invariant degradation and its restoration.
%   data = restorationOps(op, p) - called by ilab_dispatch for:
%   lpiDegrade   blur the image with a PSF and add Gaussian noise
%   deconvolve   restore it (inverse, Wiener, constrained least squares,
%                Richardson-Lucy) - all in the spatial domain
%
%   The images are limited to 400 px so the iterative restoration stays
%   interactive.

switch op
    case 'lpiDegrade'
        ilab_seed(p);
        f = ilab_limitSize(ilab_img(p), 400);
        h = psfFrom(p);
        [g, blurred] = degradeLPI(f, h, ilab_param(p, 'noiseVar', 0.0001));
        q = imageQuality(g, f);
        data = struct('cleanId', ilab_put(f, 'clean'), 'id', ilab_put(g, 'degraded'), ...
            'blurredId', ilab_put(blurred, 'blurred'), 'psfId', ilab_put(psfImage(h), 'psf'), ...
            'psfSize', size(h, 1), 'psf', ilab_matOrEmpty(smallPSF(h)), ...
            'mse', q.mse, 'psnr', q.psnr);

    case 'deconvolve'
        g = ilab_img(p);
        f = ilab_img(p, 'refId');
        h = psfFrom(p);
        method = char(ilab_param(p, 'method', 'wiener'));
        tic;
        [J, history] = deconvolveImage(g, h, method, ilab_param(p, 'lambda', 0.01), ...
            ilab_param(p, 'iterations', 25), f);
        t = 1000 * toc;
        q = imageQuality(J, f);
        data = struct('id', ilab_put(J, method), 'method', method, 'mse', q.mse, ...
            'psnr', q.psnr, 'history', history, 'timeMs', t);

    otherwise
        error('ImageLab:unknownOperation', 'Unknown operation "%s".', op);
end
end

% =========================================================================
function h = psfFrom(p)
switch char(ilab_param(p, 'psf', 'motion'))
    case 'motion',   h = blurPSF('motion', ilab_param(p, 'length', 15), ilab_param(p, 'angle', 30));
    case 'gaussian', h = blurPSF('gaussian', ilab_param(p, 'sigma', 2));
    case 'disk',     h = blurPSF('disk', ilab_param(p, 'radius', 4));
    case 'box',      h = blurPSF('box', ilab_param(p, 'size', 7));
    otherwise
        error('ImageLab:invalidParameter', 'Unknown blur "%s".', char(ilab_param(p, 'psf', '')));
end
end

function C = psfImage(h)
% The PSF enlarged so every kernel cell is visible
f = max(1, floor(200 / size(h, 1)));
C = repelem(h / max(h(:)), f, f);
end

function h = smallPSF(h)
% The kernel values, only when small enough to print as a table
if size(h, 1) > 9, h = []; end
end
