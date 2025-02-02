"use client";

import { Input } from "@/ui/input";
import { Button } from "@/ui/button";
import { PlusIcon } from "lucide-react";
import { prisma } from "@/db/connectDb";
import { v4 as uuidv4 } from "uuid";
import RedisClient from "@/db/connectCache";
import { startDiscussion } from "@/lib/actions/startDiscussion";
import { FormEvent } from "react";
import { useToast } from "@/hooks/use-toast";
import { useSocket, DiscussionAtom } from "@/store";
import { useAtom } from "jotai";
import { fetchDiscussions, Discussion } from "@/lib/actions";

export function StartDiscussion({ classroomId }: { classroomId: string }) {
  const { toast } = useToast();
  const { addConnection } = useSocket();
  const [discussions, setDiscussions] = useAtom(DiscussionAtom);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();

    const formData = new FormData(e.currentTarget);
    const discussionName = formData.get("discussionName") as string;

    const { success, message } = await startDiscussion(
      discussionName,
      classroomId,
    );

    if (success) {
      const data = await fetchDiscussions(classroomId);
      setDiscussions(data);
    }

    if (success && message?.discussionId && message.conn) {
      addConnection(message.discussionId, JSON.parse(message.conn));
    }
    toast({
      title: success ? "Success!" : "Error!",
      description: success
        ? "successfully created new discussion"
        : "unable to create a new discussion",
      variant: success ? "default" : "destructive",
    });
  }
  return (
    <form onSubmit={handleSubmit} className="flex flex-row gap-3">
      <Input
        className="bg-sidebar-accent lg:w-72"
        type="text"
        name="discussionName"
        required
        placeholder="Give a name to your new discussion"
      />
      <Button type="submit" variant="default">
        <PlusIcon className="mr-2 h-4 w-4" />
        Create
      </Button>
    </form>
  );
}
