function info = pixelNeighborhood(V, r, c, valueSet)
%PIXELNEIGHBORHOOD Neighbours and adjacency of pixel p = (r,c) in matrix V.
%   N4(p) : the 4 horizontal/vertical neighbours  (r+-1,c), (r,c+-1)
%   ND(p) : the 4 diagonal neighbours             (r+-1,c+-1)
%   N8(p) : N4(p) union ND(p)
%
%   Adjacency for pixels whose value is in valueSet (the set V):
%   4-adjacent : q in N4(p)
%   8-adjacent : q in N8(p)
%   m-adjacent : q in N4(p), OR q in ND(p) AND N4(p) n N4(q) contains no
%                pixel with a value in valueSet. m-adjacency removes the
%                ambiguous double paths that 8-adjacency creates.
%
%   Returned lists are [row col] pairs. Distance maps from p are included.

if nargin < 4 || isempty(valueSet), valueSet = 1; end
[h, w] = size(V);
inside = @(P) P(P(:,1) >= 1 & P(:,1) <= h & P(:,2) >= 1 & P(:,2) <= w, :);
inV = @(P) arrayfun(@(k) ismember(V(P(k,1), P(k,2)), valueSet), (1:size(P,1))');

N4 = inside([r-1 c; r+1 c; r c-1; r c+1]);
ND = inside([r-1 c-1; r-1 c+1; r+1 c-1; r+1 c+1]);
N8 = [N4; ND];

pInV = ismember(V(r, c), valueSet);
adj4 = N4(inV(N4), :);
adj8 = N8(inV(N8), :);

% m-adjacency
adjM = adj4;
for k = 1:size(ND, 1)
    q = ND(k, :);
    if ~ismember(V(q(1), q(2)), valueSet), continue; end
    common = [r q(2); q(1) c];              % N4(p) n N4(q) for a diagonal q
    if ~any(inV(common))
        adjM(end+1, :) = q; %#ok<AGROW>
    end
end
if ~pInV
    adj4 = zeros(0, 2); adj8 = zeros(0, 2); adjM = zeros(0, 2);
end

[C, R] = meshgrid(1:w, 1:h);
info = struct('N4', N4, 'ND', ND, 'N8', N8, ...
    'adjacent4', adj4, 'adjacent8', adj8, 'adjacentM', adjM, ...
    'centerInSet', pInV, ...
    'euclidean', sqrt((R - r).^2 + (C - c).^2), ...
    'cityBlock', abs(R - r) + abs(C - c), ...
    'chessboard', max(abs(R - r), abs(C - c)));
end
