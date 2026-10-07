function id = ilab_barChart(values, labels, chartTitle, yLabel)
%ILAB_BARCHART Draw a bar chart with MATLAB graphics and save it as an image.
%   Used by the Filter Comparison lab:  bar(psnrValues)

fig = ilab_figure(640, 360);
ax = axes(fig);
values(~isfinite(values)) = NaN;
b = bar(ax, values, 0.6, 'FaceColor', 'flat');
palette = [0.13 0.36 0.67; 0.18 0.62 0.37; 0.85 0.55 0.13; 0.55 0.33 0.66; ...
           0.80 0.25 0.25; 0.20 0.60 0.70; 0.45 0.45 0.45; 0.65 0.50 0.20];
b.CData = palette(mod(0:numel(values)-1, size(palette, 1)) + 1, :);
ax.XTick = 1:numel(values);
ax.XTickLabel = labels;
ax.FontSize = 11;
ax.Box = 'off';
grid(ax, 'on');
title(ax, chartTitle, 'FontWeight', 'bold');
ylabel(ax, yLabel);
for n = 1:numel(values)
    if isfinite(values(n))
        text(ax, n, values(n), sprintf('%.3g', values(n)), ...
            'HorizontalAlignment', 'center', 'VerticalAlignment', 'bottom', 'FontSize', 10);
    end
end
id = ilab_saveFigure(fig, 'chart');
end
