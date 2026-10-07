function [L, n] = labelComponents(BW, conn)
%LABELCOMPONENTS Label connected regions of a binary image (like bwlabel).
%   [L, n] = labelComponents(BW, conn) gives every connected group of true
%   pixels its own number 1..n. conn = 4 or 8 (default 8).
%
%   Manual algorithm (breadth-first search / flood fill):
%     for every unlabelled foreground pixel p
%         start a new label, put p in a queue
%         while the queue is not empty
%             take a pixel, give its unlabelled foreground neighbours
%             the same label and add them to the queue

if nargin < 2 || isempty(conn), conn = 8; end
BW = logical(BW);
if hasIPT()
    [L, n] = bwlabel(BW, conn);
    return
end

[h, w] = size(BW);
L = zeros(h, w);
n = 0;
if conn == 4
    offsets = [-1 0; 1 0; 0 -1; 0 1];
else
    offsets = [-1 -1; 0 -1; 1 -1; -1 0; 1 0; -1 1; 0 1; 1 1];
end
queue = zeros(h * w, 1);

for p = find(BW)'
    if L(p) ~= 0, continue; end
    n = n + 1;
    L(p) = n;
    head = 1; tail = 1; queue(1) = p;
    while head <= tail
        q = queue(head); head = head + 1;
        r = mod(q - 1, h) + 1;
        c = (q - r) / h + 1;
        for t = 1:size(offsets, 1)
            rr = r + offsets(t, 1);
            cc = c + offsets(t, 2);
            if rr >= 1 && rr <= h && cc >= 1 && cc <= w
                nq = (cc - 1) * h + rr;
                if BW(nq) && L(nq) == 0
                    L(nq) = n;
                    tail = tail + 1;
                    queue(tail) = nq;
                end
            end
        end
    end
end
end
