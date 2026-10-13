function [J, windowUsed] = adaptiveMedianFilter(I, Smax)
%ADAPTIVEMEDIANFILTER Adaptive median filter (Gonzalez & Woods).
%   [J, windowUsed] = adaptiveMedianFilter(I, Smax) grows the window at each
%   pixel from 3x3 up to Smax x Smax (odd, default 7). windowUsed holds the
%   window size each output pixel was decided with.
%
%   With zmin, zmax, zmed = min, max and median of the window and zxy the
%   pixel itself:
%     Stage A: if zmin < zmed < zmax  -> the median is not an impulse, go to B
%              else grow the window; if it exceeds Smax output zmed
%     Stage B: if zmin < zxy < zmax   -> zxy is not an impulse: KEEP it
%              else                   -> output zmed
%
%   Unlike the plain median filter it only replaces pixels that look like
%   impulses, so fine detail survives, and it copes with dense salt &
%   pepper noise (probability > 0.2) by growing the window.
%   Implemented vectorised: every pixel is processed at once for each size.

if nargin < 2 || isempty(Smax), Smax = 7; end
validateKernelSize(Smax);
Smax = max(Smax, 3);
I = toDouble(I);
[h, w, nc] = size(I);
J = zeros(h, w, nc);
windowUsed = zeros(h, w, nc);

for c = 1:nc
    X = I(:,:,c);
    out = X;
    done = false(h, w);
    used = Smax * ones(h, w);
    for s = 3:2:Smax
        S = neighborhoodStack(X, s, s, 'symmetric');
        zmin = min(S, [], 3);
        zmax = max(S, [], 3);
        zmed = median(S, 3);
        stageA = ~done & zmed > zmin & zmed < zmax;       % median is trustworthy
        keep = stageA & X > zmin & X < zmax;              % stage B1: pixel is fine
        out(keep) = X(keep);
        swap = stageA & ~keep;                            % stage B2: pixel is an impulse
        out(swap) = zmed(swap);
        used(stageA) = s;
        done = done | stageA;
    end
    out(~done) = zmed(~done);                             % window reached Smax
    J(:,:,c) = out;
    windowUsed(:,:,c) = used;
end
end
