function m = regionMoments(BW)
%REGIONMOMENTS Moment descriptors of a binary region.
%   m = regionMoments(BW) returns a struct with
%     hu          - the 7 Hu moment invariants phi1..phi7
%     orientation - angle of the major axis in degrees (anticlockwise from east)
%     majorAxis, minorAxis - axis lengths of the ellipse with the same
%                   second moments
%     eccentricity - 0 for a circle, -> 1 for a line
%
%   Moments (x = column, y = row, f = 1 inside the region):
%       m_pq  = sum x^p y^q f(x,y)
%       mu_pq = sum (x - xc)^p (y - yc)^q f(x,y)          translation invariant
%       eta_pq = mu_pq / mu_00^((p+q)/2 + 1)              also scale invariant
%   Hu combined the eta_pq into 7 values that are also invariant to
%   rotation (and, apart from the sign of phi7, to mirroring).

[y, x] = find(BW);
if isempty(x)
    error('ImageLab:invalidParameter', 'The region is empty.');
end
x = x - mean(x); y = -(y - mean(y));                % centre, y up
mu = @(p, q) sum(x.^p .* y.^q);
mu00 = numel(x);
eta = @(p, q) mu(p, q) / mu00^((p + q) / 2 + 1);
n20 = eta(2, 0); n02 = eta(0, 2); n11 = eta(1, 1);
n30 = eta(3, 0); n03 = eta(0, 3); n21 = eta(2, 1); n12 = eta(1, 2);

hu = zeros(1, 7);
hu(1) = n20 + n02;
hu(2) = (n20 - n02)^2 + 4 * n11^2;
hu(3) = (n30 - 3 * n12)^2 + (3 * n21 - n03)^2;
hu(4) = (n30 + n12)^2 + (n21 + n03)^2;
hu(5) = (n30 - 3 * n12) * (n30 + n12) * ((n30 + n12)^2 - 3 * (n21 + n03)^2) + ...
        (3 * n21 - n03) * (n21 + n03) * (3 * (n30 + n12)^2 - (n21 + n03)^2);
hu(6) = (n20 - n02) * ((n30 + n12)^2 - (n21 + n03)^2) + 4 * n11 * (n30 + n12) * (n21 + n03);
hu(7) = (3 * n21 - n03) * (n30 + n12) * ((n30 + n12)^2 - 3 * (n21 + n03)^2) - ...
        (n30 - 3 * n12) * (n21 + n03) * (3 * (n30 + n12)^2 - (n21 + n03)^2);

% principal axes from the covariance of the pixel coordinates
% (+1/12 per axis: each pixel is a unit square, not a point)
C = [mu(2, 0), mu(1, 1); mu(1, 1), mu(0, 2)] / mu00 + eye(2) / 12;
[V, D] = eig(C);
[lambda, order] = sort(diag(D), 'descend');
v = V(:, order(1));
m = struct('hu', hu, ...
    'orientation', mod(atan2d(v(2), v(1)) + 90, 180) - 90, ...
    'majorAxis', 4 * sqrt(lambda(1)), 'minorAxis', 4 * sqrt(lambda(2)), ...
    'eccentricity', sqrt(max(0, 1 - lambda(2) / lambda(1))));
end
