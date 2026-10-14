function h = figure(varargin)
%FIGURE Code Lab version of figure: hands out hidden, reusable figures.
%   figure, figure(n) and figure('Name', value, ...) take a cleared figure
%   from figurePool (milliseconds instead of seconds for a new figure);
%   figure(f) with an existing figure makes it current. Figures always stay
%   invisible - the Code Lab exports them as images.
%   Only on the MATLAB path while Code Lab code runs.

args = varargin;
if ~isempty(args) && isscalar(args{1}) && isgraphics(args{1}, 'figure')
    f = args{1};
    args(1) = [];
else
    f = figurePool('next');
    if ~isempty(args) && isnumeric(args{1}), args(1) = []; end
end
if ~isempty(args), set(f, args{:}); end
f.Visible = 'off';
set(groot, 'CurrentFigure', f);
if nargout > 0, h = f; end
end
