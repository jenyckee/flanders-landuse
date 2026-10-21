<!DOCTYPE qgis PUBLIC 'http://mrcc.com/qgis.dtd' 'SYSTEM'>
<qgis maxScale="0" styleCategories="AllStyleCategories" version="3.22.7-Białowieża" minScale="1e+08" hasScaleBasedVisibilityFlag="0">
  <flags>
    <Identifiable>1</Identifiable>
    <Removable>1</Removable>
    <Searchable>1</Searchable>
    <Private>0</Private>
  </flags>
  <temporal fetchMode="0" enabled="0" mode="0">
    <fixedRange>
      <start></start>
      <end></end>
    </fixedRange>
  </temporal>
  <customproperties>
    <Option type="Map">
      <Option name="WMSBackgroundLayer" type="QString" value="false"/>
      <Option name="WMSPublishDataSourceUrl" type="QString" value="false"/>
      <Option name="embeddedWidgets/count" type="QString" value="0"/>
      <Option name="identify/format" type="QString" value="Value"/>
    </Option>
  </customproperties>
  <pipe-data-defined-properties>
    <Option type="Map">
      <Option name="name" type="QString" value=""/>
      <Option name="properties"/>
      <Option name="type" type="QString" value="collection"/>
    </Option>
  </pipe-data-defined-properties>
  <pipe>
    <provider>
      <resampling zoomedInResamplingMethod="nearestNeighbour" maxOversampling="2" enabled="false" zoomedOutResamplingMethod="nearestNeighbour"/>
    </provider>
    <rasterrenderer opacity="1" type="paletted" nodataColor="" band="1" alphaBand="-1">
      <rasterTransparency/>
      <minMaxOrigin>
        <limits>None</limits>
        <extent>WholeRaster</extent>
        <statAccuracy>Estimated</statAccuracy>
        <cumulativeCutLower>0.02</cumulativeCutLower>
        <cumulativeCutUpper>0.98</cumulativeCutUpper>
        <stdDevFactor>2</stdDevFactor>
      </minMaxOrigin>
      <colorPalette>
        <paletteEntry label="Huizen en tuinen" color="#ff0000" alpha="255" value="1"/>
        <paletteEntry label="Industrie" color="#8400a8" alpha="255" value="2"/>
        <paletteEntry label="Commerciële doeleinden" color="#ff00c5" alpha="255" value="3"/>
        <paletteEntry label="Diensten" color="#002673" alpha="255" value="4"/>
        <paletteEntry label="Transportinfrastructuur" color="#686868" alpha="255" value="5"/>
        <paletteEntry label="Recreatie" color="#ffaa00" alpha="255" value="6"/>
        <paletteEntry label="Landbouwgebouwen en -infrastructuur" color="#a87000" alpha="255" value="7"/>
        <paletteEntry label="Overige bebouwde terreinen" color="#cccccc" alpha="255" value="8"/>
        <paletteEntry label="Overige onbebouwde terreinen" color="#828282" alpha="255" value="9"/>
        <paletteEntry label="Actieve groeves" color="#dfe6a9" alpha="255" value="10"/>
        <paletteEntry label="Luchthavens" color="#df73ff" alpha="255" value="11"/>
        <paletteEntry label="Bos" color="#267300" alpha="255" value="12"/>
        <paletteEntry label="Akker" color="#ffffbe" alpha="255" value="13"/>
        <paletteEntry label="Grasland in landbouwgebruik" color="#a3ff73" alpha="255" value="14"/>
        <paletteEntry label="Struikgewas" color="#897044" alpha="255" value="15"/>
        <paletteEntry label="Braakliggend en duinen" color="#ffd37f" alpha="255" value="16"/>
        <paletteEntry label="Water" color="#005ce6" alpha="255" value="17"/>
        <paletteEntry label="Moeras" color="#00a884" alpha="255" value="18"/>
        <paletteEntry label="Overige graslanden" color="#82ca5b" alpha="255" value="19"/>
      </colorPalette>
    </rasterrenderer>
    <brightnesscontrast brightness="0" contrast="0" gamma="1"/>
    <huesaturation saturation="0" colorizeStrength="100" colorizeBlue="128" colorizeRed="255" grayscaleMode="0" colorizeGreen="128" invertColors="0" colorizeOn="0"/>
    <rasterresampler maxOversampling="2"/>
    <resamplingStage>resamplingFilter</resamplingStage>
  </pipe>
  <blendMode>0</blendMode>
</qgis>
