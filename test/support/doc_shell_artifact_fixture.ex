for {module, id} <- [
      {PhoenixAssets.FrozenArtifactChart, "chart"},
      {PhoenixAssets.FrozenArtifactDrawing, "drawing"}
    ] do
  defmodule module do
    @moduledoc false
    @behaviour DocShell.Presentation.ArtifactProfile
    @path Path.expand("../../npm/doc-shell/test/fixtures/artifact-conformance-v1.json", __DIR__)
    @external_resource @path
    @input @path
           |> File.read!()
           |> Jason.decode!()
           |> Map.fetch!("cases")
           |> Enum.find(&(&1["id"] == id))

    @impl true
    def describe, do: @input["descriptor"]

    # This adapter accepts only the complete frozen synthetic input. It is not
    # an implementation or qualification of either external producer's meaning.
    @impl true
    def validate(block, context) do
      if block == hd(@input["content"])["meta"]["artifact"] and
           context.manifest == Jason.decode!(@input["original_manifest"]) and
           context.projection == @input["checked_projection"],
         do: {:ok, @input["checked_projection"]},
         else: {:error, :unexpected_frozen_artifact_input}
    end
  end
end
