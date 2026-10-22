function h = blurPSF(type, varargin)
%BLURPSF Point-spread function (degradation kernel) h of a blur.
%   h = blurPSF('motion', len, angle)  uniform linear motion over len pixels
%                                      in direction angle (degrees, 0 = right)
%   h = blurPSF('gaussian', sigma)     atmospheric turbulence (long exposure):
%                                      its transfer function exp(-k(u^2+v^2)^(5/6))
%                                      is close to a Gaussian
%   h = blurPSF('disk', radius)        out-of-focus lens (uniform disk)
%   h = blurPSF('box', k)              uniform k-by-k average
%
%   h is non-negative and sums to 1, so the blur keeps the mean brightness.
%   It is the image of a single bright point - the impulse response of the
%   linear, position-invariant degradation system.
%       h = fspecial('motion', len, angle);    % toolbox equivalents
%       h = fspecial('disk', radius);

switch lower(type)
    case 'motion'
        len = max(1, arg(varargin, 1, 9));
        ang = arg(varargin, 2, 0);
        n = ceil((len - 1) / 2);
        h = zeros(2 * n + 1);
        % sample the line densely and share each sample between the four
        % nearest pixels (bilinear), so any angle gives a smooth kernel
        t = linspace(-(len - 1) / 2, (len - 1) / 2, max(2, ceil(8 * len)));
        x = n + 1 + t * cosd(ang);
        y = n + 1 - t * sind(ang);              % rows grow downwards
        x0 = floor(x); y0 = floor(y); fx = x - x0; fy = y - y0;
        for d = [0 0; 1 0; 0 1; 1 1]'
            w = (d(1) * fx + (1 - d(1)) * (1 - fx)) .* (d(2) * fy + (1 - d(2)) * (1 - fy));
            r = y0 + d(2); c = x0 + d(1);
            ok = r >= 1 & r <= 2 * n + 1 & c >= 1 & c <= 2 * n + 1 & w > 0;
            h = h + accumarray([r(ok)' c(ok)'], w(ok)', size(h));
        end
    case 'gaussian'
        sigma = max(0.3, arg(varargin, 1, 2));
        h = gaussianKernel(2 * ceil(3 * sigma) + 1, sigma);
    case 'disk'
        radius = max(0.5, arg(varargin, 1, 4));
        n = ceil(radius);
        % fraction of each pixel inside the circle (5x5 sub-samples)
        s = ((1:5) - 3) / 5;
        [X, Y] = meshgrid(-n:n);
        h = zeros(size(X));
        for dx = s
            for dy = s
                h = h + ((X + dx).^2 + (Y + dy).^2 <= radius^2);
            end
        end
    case 'box'
        k = max(1, round(arg(varargin, 1, 5)));
        h = ones(k);
    otherwise
        error('ImageLab:invalidParameter', 'Unknown blur "%s".', type);
end
h = h / sum(h(:));
end

function v = arg(c, k, default)
if numel(c) >= k && ~isempty(c{k}), v = double(c{k}); else, v = default; end
end
