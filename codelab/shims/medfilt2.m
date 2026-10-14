function J = medfilt2(I, n, varargin)
%MEDFILT2 Code Lab stand-in for the toolbox medfilt2 (base MATLAB).
%   J = medfilt2(I) uses a 3-by-3 window; medfilt2(I, [m n]) any odd size.
%   Borders are padded with zeros like the toolbox default
%   (medfilt2(I, n, 'symmetric') mirrors them).

if nargin < 2 || isempty(n), n = [3 3]; end
if isscalar(n), n = [n n]; end
mode = 'zero';
if ~isempty(varargin) && strcmpi(varargin{1}, 'symmetric'), mode = 'symmetric'; end
r = floor(n / 2);
P = padImage(double(I), r(1), r(2), mode);
S = zeros([size(I, 1), size(I, 2), prod(n)]);
k = 0;
for dc = 0:n(2) - 1
    for dr = 0:n(1) - 1
        k = k + 1;
        S(:, :, k) = P(1 + dr:size(I, 1) + dr, 1 + dc:size(I, 2) + dc);
    end
end
J = median(S, 3);
if isinteger(I), J = cast(J, class(I)); elseif islogical(I), J = J > 0.5; end
end
