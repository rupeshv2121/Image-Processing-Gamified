function varargout = figurePool(action)
%FIGUREPOOL Reusable hidden figures for Code Lab runs.
%   Creating and first rendering a MATLAB figure costs seconds; clearing and
%   reusing one costs milliseconds (see also ilab_figure). While student code
%   runs, the figure stand-in (codelab/pool/figure.m) takes its figures from
%   this pool.
%
%   figurePool('warm')          render one pool figure once (call early)
%   f = figurePool('begin')     start a run: the first pool figure becomes the
%                               current figure, so imshow / plot without a
%                               "figure" call draw into it
%   f = figurePool('next')      a cleared figure for the next "figure" call
%   [drawn, all] = figurePool('end')
%                               figures drawn into during the run (in order of
%                               use) and every pool figure; afterwards the pool
%                               is hidden from other code again

persistent pool used warmed
if isempty(pool), pool = gobjects(0); used = gobjects(0); end
pool = pool(isvalid(pool));
MAX_POOL = 6;

switch action
    case 'warm'
        if isempty(warmed)
            used = gobjects(0);
            f = take();
            image(axes(f), rand(32));
            file = [tempname '.png'];
            print(f, file, '-dpng', '-r96');
            delete(file);
            clf(f);
            f.HandleVisibility = 'off';
            warmed = true;
        end
    case 'begin'
        used = gobjects(0);
        f = take();
        set(groot, 'CurrentFigure', f);
        varargout = {f};
    case 'next'
        varargout = {take()};
    case 'end'
        used = used(isvalid(used));
        drawn = used(arrayfun(@(f) ~isempty(f.Children), used));
        set(pool, 'HandleVisibility', 'off');
        varargout = {drawn, pool};
end

    function f = take()
        free = pool(~ismember(pool, used));
        if ~isempty(free)
            f = free(1);
            clf(f, 'reset');
        else
            f = builtin('figure', 'Visible', 'off');
            if numel(pool) < MAX_POOL, pool(end+1) = f; end   % extra figures are deleted after the run
        end
        set(f, 'Visible', 'off', 'Color', 'w', 'HandleVisibility', 'on', 'Position', [100 100 760 480]);
        used(end+1) = f;
    end
end
