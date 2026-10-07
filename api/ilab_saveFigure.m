function id = ilab_saveFigure(fig, tag)
%ILAB_SAVEFIGURE Export a figure as PNG into the ImageLab image store.
if nargin < 2, tag = 'chart'; end
[~, unique] = fileparts(tempname);
id = sprintf('%s_%s', tag, unique(end-11:end));
exportgraphics(fig, fullfile(ilab_store('dir'), [id '.png']), 'Resolution', 96);
end
