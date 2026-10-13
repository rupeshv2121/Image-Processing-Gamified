function S = regionGrowingSteps(A, seedRow, seedCol, tolerance, conn)
%REGIONGROWINGSTEPS Region growing on a small matrix, recording the queue order.
%   S = regionGrowingSteps(A, seedRow, seedCol, tolerance, conn)
%
%   Same breadth-first algorithm as regionGrowing.m: the seed joins the
%   region and is put in a queue; each pixel taken from the queue checks its
%   neighbours, and a neighbour joins (and is queued) when
%   |value - seed value| <= tolerance.
%
%   S.events: type 'take' (pixel leaves the queue) or 'check' (a neighbour
%   is tested: value, diff, accepted), with the queue length after the event.
%   S.region is the final mask (identical to regionGrowing).

if nargin < 4 || isempty(tolerance), tolerance = 10; end
if nargin < 5 || isempty(conn), conn = 8; end
A = double(A);
if ~ismatrix(A) || isempty(A) || numel(A) > 144
    error('ImageLab:invalidMatrix', 'Use a matrix of at most 12x12 values for the step-by-step view.');
end
[h, w] = size(A);
seedRow = round(seedRow); seedCol = round(seedCol);
if seedRow < 1 || seedRow > h || seedCol < 1 || seedCol > w
    error('ImageLab:invalidParameter', 'The seed must lie inside the matrix.');
end
if conn == 4
    offsets = [-1 0; 1 0; 0 -1; 0 1];
else
    offsets = [-1 -1; -1 0; -1 1; 0 -1; 0 1; 1 -1; 1 0; 1 1];
end
seedValue = A(seedRow, seedCol);
BW = false(h, w);
BW(seedRow, seedCol) = true;
queue = [seedRow seedCol];
head = 1;
events = {};
order = zeros(h, w);                       % the order in which pixels joined
order(seedRow, seedCol) = 1;
joined = 1;
while head <= size(queue, 1)
    r = queue(head, 1); c = queue(head, 2); head = head + 1;
    events{end+1} = struct('type', 'take', 'row', r, 'col', c, 'value', A(r, c), ...
        'diff', [], 'accepted', true, 'queue', size(queue, 1) - head + 1); %#ok<AGROW>
    for t = 1:size(offsets, 1)
        rr = r + offsets(t, 1); cc = c + offsets(t, 2);
        if rr < 1 || rr > h || cc < 1 || cc > w || BW(rr, cc), continue; end
        d = abs(A(rr, cc) - seedValue);
        ok = d <= tolerance;
        if ok
            BW(rr, cc) = true;
            queue(end+1, :) = [rr cc]; %#ok<AGROW>
            joined = joined + 1;
            order(rr, cc) = joined;
        end
        events{end+1} = struct('type', 'check', 'row', rr, 'col', cc, 'value', A(rr, cc), ...
            'diff', d, 'accepted', ok, 'queue', size(queue, 1) - head + 1); %#ok<AGROW>
    end
end
assert(isequal(BW, regionGrowing(A, seedRow, seedCol, tolerance, conn)), 'regionGrowingSteps must match regionGrowing');
S = struct('input', ilab_mat(A), 'seedRow', seedRow, 'seedCol', seedCol, 'seedValue', seedValue, ...
    'tolerance', tolerance, 'conn', conn, 'events', {events}, ...
    'region', ilab_mat(double(BW)), 'order', ilab_mat(order), 'size', nnz(BW));
end
