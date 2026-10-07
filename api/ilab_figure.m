function fig = ilab_figure(widthPx, heightPx)
%ILAB_FIGURE Reusable hidden figure for drawing charts with MATLAB graphics.
%   Creating a new figure costs seconds; clearing and reusing one costs
%   milliseconds. ilab_figure() with no output pre-creates it (warm-up).

persistent f
if isempty(f) || ~isvalid(f)
    f = figure('Visible', 'off', 'Color', 'w', 'HandleVisibility', 'off');
end
if nargin < 2, widthPx = 640; heightPx = 360; end
clf(f);
f.Position = [100 100 widthPx heightPx];
if nargout > 0
    fig = f;
else
    bar(axes(f), 1:3);          % warm-up draw and export
    exportgraphics(f, [tempname '.png'], 'Resolution', 50);
    clf(f);
end
end
