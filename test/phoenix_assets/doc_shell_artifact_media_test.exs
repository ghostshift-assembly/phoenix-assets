defmodule PhoenixAssets.DocShellArtifactMediaTest do
  @moduledoc false
  use ExUnit.Case, async: true
  alias PhoenixAssets.DocShell.ArtifactMedia
  @corpus "npm/doc-shell/test/fixtures/artifact-media-v1.json" |> File.read!() |> Jason.decode!()

  for vector <- @corpus["cases"] do
    @vector vector
    test vector["id"] do
      result = ArtifactMedia.validate(@vector["media_type"], Base.decode64!(@vector["base64"]))

      if @vector["accept"],
        do: assert(result == :ok),
        else: assert(result == {:error, :unsupported_artifact_media})
    end
  end

  test "bounds SVG byte size and exact element counts" do
    prefix = ~s(<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1">)

    assert :ok =
             ArtifactMedia.validate(
               "image/svg+xml",
               prefix <> String.duplicate("<g/>", 4095) <> "</svg>"
             )

    assert {:error, _} =
             ArtifactMedia.validate(
               "image/svg+xml",
               prefix <> String.duplicate("<g/>", 4096) <> "</svg>"
             )

    exact = prefix <> String.duplicate(" ", 1_048_576 - byte_size(prefix) - 6) <> "</svg>"
    assert byte_size(exact) == 1_048_576
    assert :ok = ArtifactMedia.validate("image/svg+xml", exact)
    assert {:error, _} = ArtifactMedia.validate("image/svg+xml", exact <> " ")
    assert {:error, _} = ArtifactMedia.validate("image/png", :binary.copy(<<0>>, 33_554_433))
  end
end
