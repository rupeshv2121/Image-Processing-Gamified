function d = chainCodeDescriptors(code)
%CHAINCODEDESCRIPTORS First difference, shape number and perimeter of a chain code.
%   d = chainCodeDescriptors(code) for a Freeman 8-direction chain code.
%
%   d.firstDifference - number of 45-degree anticlockwise turns between
%                       consecutive directions, (c(k) - c(k-1)) mod 8, with
%                       the chain treated as circular. Independent of the
%                       object's ROTATION (in 45-degree steps).
%   d.shapeNumber     - the circular rotation of the first difference that
%                       forms the smallest number. Independent of the
%                       STARTING POINT as well ('' for chains over 1000).
%   d.perimeter       - even codes are 1 pixel long, odd (diagonal) codes
%                       are sqrt(2):  P = nEven + sqrt(2) * nOdd
%   d.nEven, d.nOdd   - number of straight and diagonal steps

code = double(code(:)');
n = numel(code);
d = struct('firstDifference', zeros(1, 0), 'shapeNumber', zeros(1, 0), ...
    'perimeter', 0, 'nEven', 0, 'nOdd', 0);
if n == 0, return; end

d.nOdd = nnz(mod(code, 2));
d.nEven = n - d.nOdd;
d.perimeter = d.nEven + sqrt(2) * d.nOdd;
d.firstDifference = mod(code - code([n 1:n-1]), 8);

if n <= 1000
    fd = d.firstDifference;
    R = zeros(n);                         % every circular rotation, one per row
    for k = 1:n
        R(k, :) = fd([k:n 1:k-1]);
    end
    R = sortrows(R);                      % lexicographic order: smallest number first
    d.shapeNumber = R(1, :);
end
end
