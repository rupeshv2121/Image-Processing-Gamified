function J = mat2gray(A, limits)
%MAT2GRAY Code Lab stand-in for the toolbox mat2gray: rescale to [0,1].
A = double(A);
if nargin < 2 || isempty(limits), limits = [min(A(:)) max(A(:))]; end
if limits(2) == limits(1)
    J = double(A > limits(1));
else
    J = min(max((A - limits(1)) / (limits(2) - limits(1)), 0), 1);
end
end
