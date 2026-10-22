function J = contraharmonicMeanFilter(I, k, Q)
%CONTRAHARMONICMEANFILTER Contraharmonic mean filter of order Q.
%   J = contraharmonicMeanFilter(I, k, Q):
%
%       f(x,y) = sum g(s,t)^(Q+1) / sum g(s,t)^Q
%
%   Q > 0 removes PEPPER noise, Q < 0 removes SALT noise - never both at
%   once, so the sign of Q must match the noise.
%   Q = 0 gives the arithmetic mean, Q = -1 the harmonic mean.

if nargin < 2 || isempty(k), k = 3; end
if nargin < 3 || isempty(Q), Q = 1.5; end
validateKernelSize(k);
I = max(toDouble(I), 1e-6);              % 0^Q is Inf for Q < 0
box = ones(k);
J = filter2D(I .^ (Q + 1), box) ./ filter2D(I .^ Q, box);
J = min(max(J, 0), 1);
end
