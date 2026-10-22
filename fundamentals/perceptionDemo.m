function d = perceptionDemo(kind, varargin)
%PERCEPTIONDEMO Test images for brightness adaptation and discrimination.
%   d = perceptionDemo('machbands', nSteps)
%       Staircase of nSteps flat grey bands. d.actual is the true intensity
%       profile and d.perceived the profile after lateral inhibition (a
%       centre-surround / difference-of-Gaussians filter, a simple model of
%       the retina): it overshoots at every step - the Mach bands people see
%       although each band is perfectly flat.
%   d = perceptionDemo('simultaneous', centre)
%       The SAME grey square (intensity centre) on four backgrounds from
%       dark to bright: it looks darker on the brighter backgrounds.
%       Perceived brightness depends on the surround, not only on intensity.
%   d = perceptionDemo('weber', background, delta)
%       A disc of intensity background + delta on a flat background.
%       d.weber = delta / background is the Weber ratio; the smallest
%       visible delta (just-noticeable difference) is about 2% of the
%       background at normal brightness and much larger in dim light.
%   d.image is always a grayscale image in [0,1].

switch lower(kind)
    case 'machbands'
        n = max(3, min(16, round(arg(varargin, 1, 8))));
        w = 48;
        levels = linspace(0.15, 0.85, n);
        actual = repelem(levels, w);
        d.image = repmat(actual, 120, 1);
        % lateral inhibition: narrow excitatory centre - wide inhibitory surround
        x = -15:15;
        dog = exp(-x.^2 / (2 * 1.5^2)) / (1.5 * sqrt(2 * pi)) - exp(-x.^2 / (2 * 5^2)) / (5 * sqrt(2 * pi));
        padded = [repmat(actual(1), 1, 15), actual, repmat(actual(end), 1, 15)];
        response = conv(padded, dog, 'same');
        response = response(16:end - 15);
        d.actual = actual;
        d.perceived = actual + 2.5 * response;          % intensity + edge emphasis
    case 'simultaneous'
        c = arg(varargin, 1, 0.5);
        backs = [0.1 0.35 0.65 0.9];
        tile = 140; sq = 50;
        d.image = zeros(tile, tile * numel(backs));
        for k = 1:numel(backs)
            cols = (k - 1) * tile + (1:tile);
            d.image(:, cols) = backs(k);
            lo = (tile - sq) / 2 + 1;
            d.image(lo:lo + sq - 1, cols(lo:lo + sq - 1)) = c;
        end
        d.backgrounds = backs;
        d.centre = c;
    case 'weber'
        I0 = max(0.01, arg(varargin, 1, 0.5));
        dI = arg(varargin, 2, 0.02);
        [X, Y] = meshgrid(1:320, 1:200);
        d.image = I0 * ones(200, 320);
        d.image(hypot(X - 160, Y - 100) <= 45) = min(I0 + dI, 1);
        d.weber = dI / I0;
        d.background = I0;
        d.delta = dI;
    otherwise
        error('ImageLab:invalidParameter', 'Unknown perception demo "%s".', kind);
end
d.image = min(max(d.image, 0), 1);
end

function v = arg(c, k, default)
if numel(c) >= k && ~isempty(c{k}), v = double(c{k}); else, v = default; end
end
